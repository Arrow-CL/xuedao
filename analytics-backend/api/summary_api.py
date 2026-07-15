"""
学情梳理模块 - 小梳理 + 大梳理生成接口
阶段2：GET /api/summary/small?session_id=xxx
阶段3：GET /api/summary/chapter?user_id=xxx&chapter_id=xxx
"""

import os
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from db.database import (
    get_db,
    get_records_by_session,
    get_sessions_by_chapter,
    get_error_stats_by_chapter,
)
from db.models import PracticeRecord

router = APIRouter(prefix="/api/summary", tags=["summary"])

# LLM 配置（读取环境变量，兼容 .env）
AI_ENDPOINT = os.getenv("AI_API_ENDPOINT", "https://api.deepseek.com/v1/chat/completions")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "deepseek-chat")


async def call_llm(system_prompt: str, user_content: str = "", max_tokens: int = 1500) -> str:
    """
    调用 LLM 生成文本
    :param system_prompt: 系统提示词
    :param user_content: 用户消息（可选）
    :param max_tokens: 最大token数
    :return: LLM 返回的文本
    """
    import httpx

    messages = [{"role": "system", "content": system_prompt}]
    if user_content:
        messages.append({"role": "user", "content": user_content})

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            AI_ENDPOINT,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {AI_API_KEY}",
            },
            json={
                "model": AI_MODEL,
                "messages": messages,
                "temperature": 0.6,
                "max_tokens": max_tokens,
            },
        )

    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"LLM调用失败: {res.status_code} {res.text}")

    data = res.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "")


def load_prompt_template(filename: str) -> str:
    """
    加载 prompts/ 目录下的提示词模板
    """
    prompt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", filename)
    if not os.path.exists(prompt_path):
        raise FileNotFoundError(f"提示词模板不存在: {prompt_path}")
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def format_interaction_records(records: list) -> str:
    """
    将交互记录格式化为 LLM 可读的文本
    按题目分组，每道题列出所有交互轮次
    """
    # 按题目分组
    by_question = {}
    for r in records:
        qid = r.q_id
        if qid not in by_question:
            by_question[qid] = []
        by_question[qid].append(r)

    sections = []
    for qid, recs in by_question.items():
        lines = [f"【题目ID: {qid}】"]
        for i, r in enumerate(recs, 1):
            time_str = r.interaction_time.strftime("%H:%M:%S") if r.interaction_time else "未知时间"
            lines.append(f"  交互#{i}（{time_str}，耗时{r.cost_time}秒）:")
            if r.student_answer:
                lines.append(f"    学生回答：{r.student_answer}")
            if r.ai_guide_content:
                lines.append(f"    AI引导：{r.ai_guide_content}")
            if r.error_type:
                lines.append(f"    错误分类：{r.error_type}")
            if r.block_step:
                lines.append(f"    卡壳步骤：{r.block_step}")
            if r.error_calc_content:
                lines.append(f"    计算错误式子：{r.error_calc_content}")
            if r.related_knowledge:
                lines.append(f"    薄弱知识点：{r.related_knowledge}")
        sections.append("\n".join(lines))

    return "\n\n".join(sections)


# ========== 阶段2：小梳理接口 ==========

@router.get("/small")
async def generate_small_summary(
    session_id: str = Query(..., description="4题一套的会话ID"),
    db: Session = Depends(get_db)
):
    """
    生成单套4题的小节梳理
    ① 根据 session_id 拉取全套交互日志
    ② 填充 small_summary.prompt 模板
    ③ 调用 LLM 生成结构化梳理文本
    """
    # 1. 拉取全套交互日志
    records = get_records_by_session(db, session_id)
    if not records:
        raise HTTPException(status_code=404, detail=f"未找到会话 {session_id} 的记录")

    # 2. 获取题目信息
    from db.models import Question
    question_ids = list(set(r.q_id for r in records))
    questions = {}
    for qid in question_ids:
        q = db.query(Question).filter(Question.q_id == qid).first()
        if q:
            questions[qid] = {
                "title": q.question_content[:50] + ("..." if len(q.question_content) > 50 else ""),
                "content": q.question_content,
                "knowledge_points": q.knowledge_points or "[]",
            }
        else:
            questions[qid] = {"title": "未知题目", "content": "", "knowledge_points": "[]"}

    # 3. 格式化交互记录
    interaction_text = format_interaction_records(records)

    # 4. 加载并填充提示词模板
    template = load_prompt_template("small_summary.prompt")
    prompt = template.format(
        session_id=session_id,
        question_count=len(questions),
        interaction_records=interaction_text,
        question_title=questions.get(question_ids[0], {}).get("title", "未知"),
        knowledge_points=questions.get(question_ids[0], {}).get("knowledge_points", "[]"),
    )

    # 5. 调用 LLM 生成小梳理
    try:
        summary_text = await call_llm(prompt, max_tokens=1500)
    except HTTPException:
        summary_text = _fallback_small_summary(session_id, records, questions)

    return {
        "session_id": session_id,
        "question_count": len(questions),
        "total_records": len(records),
        "summary": summary_text,
    }


def _fallback_small_summary(session_id: str, records: list, questions: dict) -> str:
    """
    LLM 不可用时的本地 fallback
    基于交互记录直接生成简单的结构化文本
    """
    from collections import Counter

    lines = [f"# 本套{len(questions)}题知识点小梳理（会话ID：{session_id}）\n"]

    for qid, recs_sorted in _group_records_by_question(records).items():
        q_info = questions.get(qid, {"title": "未知题目", "knowledge_points": "[]"})
        lines.append(f"## 第1题 {q_info['title']}")
        lines.append(f"- **绑定知识点**：{q_info['knowledge_points']}")

        # 错误统计
        error_types = [r.error_type for r in recs_sorted if r.error_type]
        error_counter = Counter(error_types)
        main_error = error_counter.most_common(1)[0][0] if error_counter else "无错误"

        lines.append(f"- **问题分类**：{main_error}")

        # 薄弱点
        weak_points = list(set(r.related_knowledge for r in recs_sorted if r.related_knowledge))
        if weak_points:
            lines.append(f"- **薄弱点标记**：{', '.join(weak_points)}")

        lines.append("")

    lines.append("---\n### 本套整体小结")
    lines.append("- 请参考AI生成的完整梳理内容")

    return "\n".join(lines)


def _group_records_by_question(records: list) -> dict:
    """按题目ID分组记录"""
    grouped = {}
    for r in records:
        if r.q_id not in grouped:
            grouped[r.q_id] = []
        grouped[r.q_id].append(r)
    return grouped


# ========== 阶段3：章节大梳理接口 ==========

@router.get("/chapter")
async def generate_chapter_summary(
    user_id: str = Query(..., description="用户ID"),
    chapter_id: str = Query(..., description="章节ID"),
    db: Session = Depends(get_db)
):
    """
    生成章节大梳理
    ① 查询该用户本章节全部 session_id
    ② 统计全章节各知识点出错频次
    ③ 聚合所有小梳理数据
    ④ 调用 LLM 生成章节总梳理
    """
    # 1. 查询该用户本章节全部会话
    sessions = get_sessions_by_chapter(db, chapter_id, user_id)
    if not sessions:
        raise HTTPException(
            status_code=404,
            detail=f"未找到用户 {user_id} 在章节 {chapter_id} 的做题记录"
        )

    # 2. 统计全章节错误频次
    error_stats = get_error_stats_by_chapter(db, chapter_id, user_id)
    error_stats_text = "\n".join(
        f"- {kp}（出错{count}次）" for kp, count in error_stats.items()
    ) if error_stats else "全章节无错误记录"

    # 3. 获取章节信息
    from db.models import Chapter
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    chapter_name = chapter.chapter_name if chapter else "未知章节"

    # 4. 生成每套会话的简报（作为大梳理输入）
    all_summaries = []
    session_details = []
    for sid, records in sessions.items():
        # 获取题目信息
        question_ids = list(set(r.q_id for r in records))
        from db.models import Question
        q_titles = []
        for qid in question_ids:
            q = db.query(Question).filter(Question.q_id == qid).first()
            q_titles.append(q.question_content[:60] if q else "未知题目")

        # 统计本套错误
        from collections import Counter
        errors = [r.error_type for r in records if r.error_type and r.error_type != "完全做对"]
        error_counter = Counter(errors)

        # 收集薄弱知识点
        weak_kps = list(set(
            r.related_knowledge for r in records
            if r.related_knowledge and r.error_type != "完全做对"
        ))

        session_text = (
            f"【会话 {sid}】共{len(question_ids)}道题\n"
            f"题目：{', '.join(q_titles)}\n"
            f"错误分类统计：{dict(error_counter.most_common()) if error_counter else '全部做对'}\n"
            f"暴露的薄弱知识点：{', '.join(weak_kps) if weak_kps else '无'}\n"
            f"交互轮次：{len(records)}次"
        )
        session_details.append(session_text)

        # 同时生成小梳理的原始交互摘要
        interaction_text = format_interaction_records(records)
        all_summaries.append(f"### 会话 {sid}\n{interaction_text}")

    all_summaries_text = "\n\n".join(all_summaries)

    # 5. 加载并填充大梳理提示词
    template = load_prompt_template("chapter_summary.prompt")
    prompt = template.format(
        user_name=user_id,
        chapter_name=chapter_name,
        all_small_summaries=all_summaries_text,
        error_stats=error_stats_text,
    )

    # 6. 调用 LLM 生成大梳理
    try:
        summary_text = await call_llm(prompt, max_tokens=2000)
    except HTTPException:
        summary_text = _fallback_chapter_summary(
            user_id, chapter_name, sessions, error_stats
        )

    return {
        "user_id": user_id,
        "chapter_id": chapter_id,
        "chapter_name": chapter_name,
        "session_count": len(sessions),
        "total_records": sum(len(recs) for recs in sessions.values()),
        "error_stats": error_stats,
        "summary": summary_text,
    }


def _fallback_chapter_summary(
    user_id: str,
    chapter_name: str,
    sessions: dict,
    error_stats: dict,
) -> str:
    """
    LLM 不可用时的本地 fallback
    基于统计数据生成简单的章节梳理
    """
    total_records = sum(len(recs) for recs in sessions.values())

    lines = [
        f"# 【章节完整知识点大梳理】章节名：{chapter_name}  学生：{user_id}\n",
        "## 一、本章完整知识框架整合",
        f"本章共完成{len(sessions)}套练习，累计{total_records}次交互。",
    ]

    # 薄弱点
    if error_stats:
        lines.append("\n## 二、高频薄弱点（重点加粗标红）")
        for kp, count in error_stats.items():
            marker = "**" if count >= 2 else ""
            lines.append(f"- {marker}{kp}（出错{count}次）{marker}")

    lines.append("\n## 三、分层掌握评估")
    lines.append("1. **完全掌握**：请参考AI生成的完整梳理内容")
    lines.append("2. **轻度薄弱**：请参考AI生成的完整梳理内容")
    lines.append("3. **核心盲区**：请参考AI生成的完整梳理内容")

    lines.append("\n## 四、针对性复习建议")
    lines.append("- 请参考AI生成的完整梳理内容")

    return "\n".join(lines)

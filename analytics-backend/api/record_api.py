"""
学情梳理模块 - 交互埋点接口
接收前端做题交互数据，自动打标入库
POST /api/practice/record
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from db.database import get_db, create_record, ensure_chapter_exists, ensure_question_exists
from db.models import PracticeRecord

router = APIRouter(prefix="/api/practice", tags=["practice"])


class PracticeRecordRequest(BaseModel):
    """
    做题交互记录请求体
    每次调用AI做题引导API时，前端同步上报此结构
    """
    user_id: str = Field(..., description="用户唯一标识")
    q_id: str = Field(..., description="题目唯一标识")
    chapter_id: str = Field(..., description="章节ID")
    chapter_name: str = Field(..., description="章节名称（自动创建章节用）")
    practice_session_id: str = Field(..., description="4题一套会话ID")

    question_content: str = Field(..., description="题目完整内容（LaTeX原文）")
    knowledge_points: Optional[str] = Field("[]", description="绑定知识点JSON数组")
    difficulty: Optional[int] = Field(2, description="难度 1=基础 2=中等 3=进阶")

    student_answer: Optional[str] = Field(None, description="学生作答内容")
    ai_guide_content: Optional[str] = Field(None, description="AI引导原文")
    error_type: Optional[str] = Field(None, description="错误类型：知识盲区/思路卡壳/计算失误/审题错误/完全做对")
    block_step: Optional[str] = Field(None, description="卡壳步骤描述")
    error_calc_content: Optional[str] = Field(None, description="计算错误式子")
    related_knowledge: Optional[str] = Field(None, description="薄弱知识点")
    cost_time: Optional[int] = Field(0, description="思考耗时秒数")


class PracticeRecordResponse(BaseModel):
    """埋点记录响应"""
    record_id: str
    message: str


@router.post("/record", response_model=PracticeRecordResponse)
def record_practice(
    req: PracticeRecordRequest,
    db: Session = Depends(get_db)
):
    """
    接收做题交互数据并入库
    - 自动创建/更新章节和题目记录
    - 自动识别学生回答打上error_type标签（前端传入或后端推断）
    - 返回record_id供后续查询
    """
    try:
        # 1. 确保章节和题目存在（不存在则自动创建）
        ensure_chapter_exists(
            db,
            chapter_id=req.chapter_id,
            chapter_name=req.chapter_name,
        )
        ensure_question_exists(
            db,
            q_id=req.q_id,
            chapter_id=req.chapter_id,
            question_content=req.question_content,
            knowledge_points=req.knowledge_points,
            difficulty=req.difficulty,
        )

        # 2. 组装记录数据
        record_data = {
            "user_id": req.user_id,
            "q_id": req.q_id,
            "chapter_id": req.chapter_id,
            "practice_session_id": req.practice_session_id,
            "student_answer": req.student_answer,
            "ai_guide_content": req.ai_guide_content,
            "error_type": req.error_type,
            "block_step": req.block_step,
            "error_calc_content": req.error_calc_content,
            "related_knowledge": req.related_knowledge,
            "cost_time": req.cost_time,
            "interaction_time": datetime.utcnow(),
        }

        # 3. 入库
        record = create_record(db, record_data)

        return PracticeRecordResponse(
            record_id=record.record_id,
            message="记录已保存",
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"记录保存失败: {str(e)}")


@router.get("/records/{session_id}")
def get_records_by_session(session_id: str, db: Session = Depends(get_db)):
    """
    按 practice_session_id 查询一套4题的所有交互日志
    用于小梳理时拉取全套数据
    """
    from db.database import get_records_by_session as _get_session_records
    records = _get_session_records(db, session_id)
    if not records:
        raise HTTPException(status_code=404, detail=f"未找到会话 {session_id} 的记录")
    return {
        "session_id": session_id,
        "record_count": len(records),
        "records": [r.to_dict() for r in records],
    }


@router.get("/records/chapter/{chapter_id}")
def get_records_by_chapter(
    chapter_id: str,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    按章节ID查询整章所有会话记录
    用于大梳理时聚合数据
    """
    from db.database import get_sessions_by_chapter as _get_chapter_sessions
    sessions = _get_chapter_sessions(db, chapter_id, user_id)
    if not sessions:
        raise HTTPException(status_code=404, detail=f"未找到章节 {chapter_id} 的记录")

    return {
        "chapter_id": chapter_id,
        "session_count": len(sessions),
        "sessions": {
            sid: [r.to_dict() for r in recs]
            for sid, recs in sessions.items()
        },
    }

"""
学情梳理模块 - 数据库连接与CRUD工具
SQLite + SQLAlchemy，启动自动建表
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from db.models import Base

# SQLite 数据库文件路径（项目根目录下）
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "learning_analytics.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# 创建引擎（check_same_thread=False 允许多线程访问 SQLite）
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,  # 生产环境关闭SQL日志
)

# Session 工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """
    初始化数据库：自动创建所有表
    服务启动时调用一次即可
    """
    Base.metadata.create_all(bind=engine)
    print(f"[DB] 数据库已初始化: {DB_PATH}")


def get_db() -> Session:
    """
    获取数据库会话（FastAPI Dependency 用）
    使用 yield 确保会话自动关闭
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ========== CRUD 工具函数 ==========

def create_record(db: Session, record_data: dict):
    """
    插入一条 PracticeRecord 记录
    :param db: 数据库会话
    :param record_data: 字典，包含所有字段
    :return: 创建的记录对象
    """
    from db.models import PracticeRecord
    record = PracticeRecord(**record_data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_records_by_session(db: Session, session_id: str):
    """
    按 practice_session_id 批量查询一套4题的所有交互日志
    :param session_id: 4题一套会话ID
    :return: PracticeRecord 列表
    """
    from db.models import PracticeRecord
    return db.query(PracticeRecord).filter(
        PracticeRecord.practice_session_id == session_id
    ).order_by(PracticeRecord.interaction_time).all()


def get_sessions_by_chapter(db: Session, chapter_id: str, user_id: str = None):
    """
    按章节ID查询所有会话记录
    :param chapter_id: 章节ID
    :param user_id: 可选，过滤特定用户
    :return: (session_id列表, 关联记录列表)
    """
    from db.models import PracticeRecord
    query = db.query(PracticeRecord).filter(PracticeRecord.chapter_id == chapter_id)
    if user_id:
        query = query.filter(PracticeRecord.user_id == user_id)
    records = query.order_by(PracticeRecord.interaction_time).all()

    # 按 session_id 分组
    sessions = {}
    for r in records:
        sid = r.practice_session_id
        if sid not in sessions:
            sessions[sid] = []
        sessions[sid].append(r)
    return sessions


def get_error_stats_by_chapter(db: Session, chapter_id: str, user_id: str = None):
    """
    统计某章节下各知识点的出错频次
    :return: {知识点: 出错次数} 字典
    """
    from db.models import PracticeRecord
    from collections import Counter

    query = db.query(PracticeRecord).filter(
        PracticeRecord.chapter_id == chapter_id,
        PracticeRecord.error_type != "完全做对"
    )
    if user_id:
        query = query.filter(PracticeRecord.user_id == user_id)

    records = query.all()
    error_knowledge = []
    for r in records:
        if r.related_knowledge:
            # 简单按逗号分割知识点（可根据实际格式调整）
            kps = [kp.strip() for kp in r.related_knowledge.split(",") if kp.strip()]
            error_knowledge.extend(kps)

    return dict(Counter(error_knowledge).most_common())


def ensure_chapter_exists(db: Session, chapter_id: str, chapter_name: str, subject: str = "数学", core_knowledge_list: str = "[]"):
    """
    确保章节存在，不存在则自动创建
    """
    from db.models import Chapter
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    if not chapter:
        chapter = Chapter(
            chapter_id=chapter_id,
            chapter_name=chapter_name,
            subject=subject,
            core_knowledge_list=core_knowledge_list,
        )
        db.add(chapter)
        db.commit()
        db.refresh(chapter)
    return chapter


def ensure_question_exists(db: Session, q_id: str, chapter_id: str, question_content: str, knowledge_points: str = "[]", difficulty: int = 2):
    """
    确保题目存在，不存在则自动创建
    """
    from db.models import Question
    question = db.query(Question).filter(Question.q_id == q_id).first()
    if not question:
        question = Question(
            q_id=q_id,
            chapter_id=chapter_id,
            question_content=question_content,
            knowledge_points=knowledge_points,
            difficulty=difficulty,
        )
        db.add(question)
        db.commit()
        db.refresh(question)
    return question

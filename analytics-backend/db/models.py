"""
学情梳理模块 - 数据库模型定义
使用 SQLAlchemy ORM 映射 SQLite 数据表
支持：用户、章节、题目、做题交互日志（PracticeRecord核心表）
"""

from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import uuid

Base = declarative_base()


class User(Base):
    """
    用户表
    存储学生基本信息，后续可按年级、科目做学情分层
    """
    __tablename__ = "users"

    user_id = Column(String(64), primary_key=True, comment="用户唯一标识")
    username = Column(String(128), nullable=False, comment="用户名/昵称")
    grade = Column(String(32), comment="年级，如高三")
    subject = Column(String(32), comment="科目，如数学")
    created_at = Column(DateTime, default=datetime.utcnow, comment="注册时间")

    # 关联：一个用户有多条做题记录
    records = relationship("PracticeRecord", back_populates="user")


class Chapter(Base):
    """
    章节表
    定义课程章节结构，每个章节包含若干核心知识点
    """
    __tablename__ = "chapters"

    chapter_id = Column(String(64), primary_key=True, comment="章节唯一标识")
    chapter_name = Column(String(256), nullable=False, comment="章节名称，如平面向量")
    subject = Column(String(32), comment="所属科目")
    core_knowledge_list = Column(Text, comment="核心知识点列表，JSON数组字符串")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    # 关联：一个章节有多道题目、多条记录
    questions = relationship("Question", back_populates="chapter")
    records = relationship("PracticeRecord", back_populates="chapter")


class Question(Base):
    """
    题目表
    存储每道题的题干、绑定知识点、难度
    """
    __tablename__ = "questions"

    q_id = Column(String(64), primary_key=True, comment="题目唯一标识")
    chapter_id = Column(String(64), ForeignKey("chapters.chapter_id"), comment="所属章节ID")
    question_content = Column(Text, nullable=False, comment="题目完整内容（LaTeX原文）")
    knowledge_points = Column(Text, comment="绑定知识点，JSON数组字符串")
    difficulty = Column(Integer, default=2, comment="难度 1=基础 2=中等 3=进阶")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    # 关联
    chapter = relationship("Chapter", back_populates="questions")
    records = relationship("PracticeRecord", back_populates="question")


class PracticeRecord(Base):
    """
    【核心表】单题交互日志
    每次调用AI做题引导API时同步插入一条记录
    完整还原学生做题全过程：回答内容、AI引导、错误分类、卡壳步骤、薄弱知识点
    """
    __tablename__ = "practice_records"

    record_id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()),
                       comment="记录唯一UUID")
    user_id = Column(String(64), ForeignKey("users.user_id"), nullable=False,
                     comment="关联用户ID")
    q_id = Column(String(64), ForeignKey("questions.q_id"), nullable=False,
                  comment="关联题目ID")
    chapter_id = Column(String(64), ForeignKey("chapters.chapter_id"),
                        comment="关联章节ID（冗余，方便按章节查询）")
    practice_session_id = Column(String(64), nullable=False,
                                 comment="4题一套会话ID，用于小梳理批量拉取")

    interaction_time = Column(DateTime, default=datetime.utcnow,
                              comment="本次交互发生时间")
    student_answer = Column(Text, comment="学生手写/输入的作答内容")
    ai_guide_content = Column(Text, comment="本次调用API返回的AI引导原文")

    # 错误分类标签（核心字段）
    error_type = Column(String(32), comment="错误类型枚举：知识盲区/思路卡壳/计算失误/审题错误/完全做对")
    block_step = Column(Text, comment="卡壳步骤描述（空则无卡顿）")
    error_calc_content = Column(Text, comment="计算错误式子（空则无计算错）")
    related_knowledge = Column(Text, comment="当前交互暴露的薄弱知识点")
    cost_time = Column(Integer, default=0, comment="本次思考耗时秒数")

    # 关联
    user = relationship("User", back_populates="records")
    question = relationship("Question", back_populates="records")
    chapter = relationship("Chapter", back_populates="records")

    def to_dict(self):
        """序列化为字典，方便接口返回"""
        return {
            "record_id": self.record_id,
            "user_id": self.user_id,
            "q_id": self.q_id,
            "chapter_id": self.chapter_id,
            "practice_session_id": self.practice_session_id,
            "interaction_time": self.interaction_time.isoformat() if self.interaction_time else None,
            "student_answer": self.student_answer,
            "ai_guide_content": self.ai_guide_content,
            "error_type": self.error_type,
            "block_step": self.block_step,
            "error_calc_content": self.error_calc_content,
            "related_knowledge": self.related_knowledge,
            "cost_time": self.cost_time,
        }

"""
学情梳理模块 - FastAPI 项目入口
阶段1+2：交互埋点 + 小梳理接口
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import init_db
from api.record_api import router as record_router
from api.summary_api import router as summary_router

app = FastAPI(
    title="学导AI - 学情梳理模块",
    description="记录做题交互、生成小节梳理与章节大梳理",
    version="2.0.0",
)

# CORS：允许前端跨域访问（开发环境开放，生产环境按需限制）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 启动时自动创建数据库表
@app.on_event("startup")
def on_startup():
    init_db()

# 健康检查
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "learning-analytics"}

# 阶段1：交互埋点接口
app.include_router(record_router)

# 阶段2：小梳理接口
app.include_router(summary_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

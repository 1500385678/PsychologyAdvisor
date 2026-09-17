# PsychologyAdvisor · Backend Dockerfile
#
# Phase 1 #8 Docker Compose(0918 T3 立)· 后端镜像
#   基础:python:3.11-slim
#   依赖:fastapi + uvicorn[standard] + pydantic(0917 未新增)
#   入口:uvicorn main:app --host 0.0.0.0 --port 8000
#   数据:/app/data 读取 scales/_index.json 等只读资产(挂载点)
#   写入:/app/backend/data/diary_store(独立挂载,持久化)
#   关键环境变量:PSY_JWT_SECRET(必填,见 docker-compose.yml / .env.example)

FROM python:3.11-slim

# 不写 .pyc + 立即输出日志
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 工作目录
WORKDIR /app

# 先 copy requirements 单独 layer,利用 Docker 缓存(requirements 变化频率低)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# copy 后端源码
COPY backend/main.py /app/backend/main.py

# copy 项目根只读资产(Phase 0 数据层:scales/concepts/crisis_keywords/mood_tags/resources)
# 注意:这些文件在容器内只读,docker-compose 也会再挂载一遍方便开发模式热更新
COPY data/ /app/data/

# 暴露端口(与 docker-compose.yml ports 对齐)
EXPOSE 8000

# 健康检查(20s 后开始,5s 间隔,3 次失败 = unhealthy)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; r=urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3); sys.exit(0 if r.status==200 else 1)" || exit 1

# 启动 uvicorn
#   --host 0.0.0.0 让 docker 容器可被前端 nginx 反代
#   --proxy-headers 信任 X-Forwarded-* 头(经 nginx 反代后保留 client IP)
#   --workers 1(单机起步,MVP 阶段足够;生产可改 gunicorn + 多 worker)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
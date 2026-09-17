# PsychologyAdvisor · Frontend Dockerfile
#
# Phase 1 #8 Docker Compose(0918 T3 立)· 前端镜像
#   基础:nginx:1.27-alpine(轻量,主流 LTS)
#   内容:frontend/index.html + frontend/src/ + frontend/package.json(只 metadata)
#   行为:静态文件服务 + nginx 反代 /api/* /auth/* 给 backend:8000
#   暴露端口:8080(host 可映射任意,容器内固定 8080)
#
# 为什么不用多阶段构建:frontend 是纯 ES Module 静态文件(0 依赖),
#   无 npm install / 无构建步骤,直接 COPY + nginx serve 即可

FROM nginx:1.27-alpine

# 删除默认站点
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# 复制 nginx 配置(反代 backend:8000)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 复制 frontend 静态文件
COPY frontend/index.html /usr/share/nginx/html/index.html
COPY frontend/package.json /usr/share/nginx/html/package.json
COPY frontend/src/ /usr/share/nginx/html/src/
COPY frontend/README.md /usr/share/nginx/html/README.md

# 暴露 8080(避免与本机 80 冲突,docker-compose 端口映射 host:8080 → container:8080)
EXPOSE 8080

# 健康检查(curl 由 nginx:alpine 自带)
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

# nginx 默认 CMD 是前台跑 nginx,无需覆盖
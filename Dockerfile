FROM node:20-bookworm
RUN apt-get update && apt-get install -y \
    curl git tmux \
    tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p input output archive logs cases
ENV PORT=3847 HOST=0.0.0.0 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 TEAMMATE_MODE=tmux
EXPOSE 3847
CMD ["node", "backend/src/server.js"]

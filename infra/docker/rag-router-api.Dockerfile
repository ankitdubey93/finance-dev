# RAG Router's Node backend. Shared types are `import type` only (erased at
# runtime by tsx/esbuild), so the image needs just express + tsx.
FROM node:20-slim

WORKDIR /app

# Install runtime deps directly (avoids the workspace: protocol in the image).
# multer handles knowledge-source file uploads (buffered, base64-forwarded to AI).
RUN npm install --no-save express@^4.21.2 tsx@^4.19.2 multer@^2.0.1

COPY apps/rag-router-api/src ./src

EXPOSE 3101
CMD ["npx", "tsx", "src/main.ts"]

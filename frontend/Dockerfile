FROM node:22.14

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]

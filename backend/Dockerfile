FROM node:22

WORKDIR /app

# Copy only package files first for caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest (node_modules excluded by .dockerignore)
COPY . .

EXPOSE 4000
CMD ["npm", "run", "dev"]

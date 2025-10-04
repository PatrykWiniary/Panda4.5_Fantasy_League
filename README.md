How to run:
1. Whole app
- in root folder
- docker-compose up
- optional --build flag if running for the 1st time or rebuilding

2. Just Front/Backend
- in front/backend folder
- docker run --rm -p 5173:5173 --name frontend-1 fantasy-footbalol-frontend
- to stop: docker stop frontend-1

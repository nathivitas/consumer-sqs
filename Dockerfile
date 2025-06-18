FROM public.ecr.aws/docker/library/node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "consumer.js"]


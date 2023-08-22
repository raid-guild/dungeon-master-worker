FROM node:16

WORKDIR /src

COPY package.json .
COPY yarn.lock .
COPY tsconfig.json .

RUN yarn install --frozen-lockfile

COPY . .

ENV PORT=8080

EXPOSE 8080

CMD ["yarn", "start"]

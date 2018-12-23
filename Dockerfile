FROM resin/armv7hf-debian:stretch

RUN [ "cross-build-start" ]

RUN mkdir -p /app/secrets
WORKDIR /app

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -

RUN apt update && apt install -y \
    nodejs \
    build-essential \
    python-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json /app
COPY package-lock.json /app
RUN npm i
COPY . /app

RUN [ "cross-build-end" ]

VOLUME ["/app/secrets"]

CMD [ "npm", "start" ]



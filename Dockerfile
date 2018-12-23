FROM resin/armv7hf-debian

RUN [ "cross-build-start" ]

RUN mkdir -p /usr/src/app/secrets
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    nodejs \ # TODO: Use newer package instead
    npm
RUN ln -s /usr/bin/nodejs /usr/bin/node

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

RUN [ "cross-build-end" ]

VOLUME ["/usr/src/app/secrets"]

CMD [ "npm", "start" ]



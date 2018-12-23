FROM resin/armv7hf-debian

RUN [ "cross-build-start" ]

RUN mkdir -p /usr/src/app/secrets
WORKDIR /usr/src/app

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

RUN apt-get update && apt-get install -y \
    nodejs
    yarn
RUN ln -s /usr/bin/nodejs /usr/bin/node

COPY package.json /usr/src/app/
RUN yarn install
COPY . /usr/src/app

RUN [ "cross-build-end" ]

VOLUME ["/usr/src/app/secrets"]

CMD [ "npm", "start" ]



FROM node:8
WORKDIR /workdir
VOLUME /workdir
COPY ./build /keytool
COPY ./package.json /keytool/package.json
COPY ./package-lock.json /keytool/package-lock.json
RUN cd /keytool; npm install
ENTRYPOINT [ "node","/keytool/kt.js" ]





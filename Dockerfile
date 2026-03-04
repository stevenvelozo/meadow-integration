FROM node:20-bookworm AS base
MAINTAINER steven velozo <steven@velozo.com>

RUN apt-get update && apt-get -y --force-yes install curl vim nano less \
	tmux uuid-runtime

# Setup node.js global tools
RUN npm install -g nodemon --unsafe-perm

ADD package.json /service_root/package.json
RUN cd /service_root && npm install --omit=dev

ADD source /service_root/source
ADD scripts /service_root/scripts

WORKDIR /service_root

# Don't leave local artifacts around
RUN rm -rf package-lock.json .git test

# Default config file for Docker deployments
RUN if [ -f ./Meadow-Config-Docker.json ]; then mv ./Meadow-Config-Docker.json ./source/cli/Default-Meadow-Integration-Configuration.json; fi

FROM base AS production

RUN date -u +"%Y-%m-%dT%H:%M:%SZ" > ./build.date

CMD ["scripts/run.sh"]

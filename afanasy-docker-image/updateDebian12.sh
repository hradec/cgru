#!/bin/bash

docker-compose build
docker run --rm -ti  -v $(pwd):/f hradec/afserver:3.4.0-debian12 cp /opt/cgru/afanasy/bin/afrender /f/
rsync -avpP ./afrender root@240.1.0.100:/opt/cgru/afanasy/bin/afrender

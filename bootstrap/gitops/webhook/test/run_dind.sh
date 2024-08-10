#!/bin/bash
set -e

echo "Preparing network and volumes..."

docker network ls | grep dind-network || docker network create dind-network
docker volume ls | grep dind-certs-ca || docker volume create dind-certs-ca
docker volume ls | grep dind-certs-client || docker volume create dind-certs-client
docker volume ls | grep dind-data || docker volume create dind-data

echo "Starting Docker container..."

cleanup() {
	if [ -n "$CONTAINER_ID" ]; then
		echo "Cleaning up: Stopping the container..."
		docker stop "$CONTAINER_ID" >/dev/null 2>&1

		docker volume ls | grep dind-certs-ca && docker volume delete dind-certs-ca
		docker volume ls | grep dind-certs-client && docker volume delete dind-certs-client
		docker volume ls | grep dind-data && docker volume delete dind-data
	fi
}

trap cleanup EXIT

CONTAINER_ID=$(docker run --rm -d --privileged \
	--network dind-network --network-alias docker \
	-e DOCKER_TLS_CERTDIR=/certs \
	-e DOCKER_TLS_CERTPATH=/certs/client \
	-e DOCKER_TLS_VERIFY=1 \
	-e DOCKER_HOST='tcp://127.0.0.1:2376' \
	--volume dind-data:/data \
	--volume dind-certs-ca:/certs/ca \
	--volume dind-certs-client:/certs/client \
	--volume "$(pwd):$(pwd)" \
	--workdir "$(pwd)" \
	webhook-test:latest)

echo "Container started with ID: $CONTAINER_ID"

# Give the container time to stabilise.
sleep 1

echo "Starting container registry..."
docker exec -it "$CONTAINER_ID" sh -c 'docker run -d -p 5000:5000 registry:2'

echo "Executing command in the container..."
docker exec -it "$CONTAINER_ID" sh -c 'node test/slow.js'

echo "Done."

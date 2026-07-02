"# FinkenRoulette" 

## Docker

This project can be built as a Docker image. The container serves the built Vite app with Nginx.

The `data` directory is kept in the repository for runtime data files, but it is not baked into the Docker image. Mount the directory into the container at runtime.

### Docker Compose example

```yaml
services:
  finkenroulette:
    image: ghcr.io/FailedMaster/finkenroulette:latest
    container_name: finkenroulette
    restart: unless-stopped

    ports:
      - "8080:8080"

    networks:
      - finkenroulette

    read_only: true
    tmpfs:
      - /tmp
      - /var/cache/nginx
      - /var/run

    security_opt:
      - no-new-privileges:true

    cap_drop:
      - ALL

networks:
  finkenroulette
```
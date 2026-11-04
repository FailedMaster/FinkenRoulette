# FinkenRoulette

## Development

The frontend is a React app built with Vite. Run `npm install` once, then
`npm run dev` to start the development server. Run `npm run build` to create
the production bundle in `dist/`.

## Docker

This project can be built as a Docker image. The container serves the built Vite app with Nginx.

The beer data is kept in `public/` and is baked into the Docker image during the build.

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
  finkenroulette:
    name: finkenroulette
```

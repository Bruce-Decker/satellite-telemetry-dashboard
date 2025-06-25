FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY main.go .

RUN go mod init telemetry-generator
RUN go mod tidy
RUN go build -o telemetry-generator .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/telemetry-generator .
CMD ["./telemetry-generator"] 
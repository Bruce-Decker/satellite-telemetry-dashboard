FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod .
COPY main.go .

RUN go mod download
RUN go mod tidy
RUN go build -o telemetry-api .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/telemetry-api .
CMD ["./telemetry-api"] 
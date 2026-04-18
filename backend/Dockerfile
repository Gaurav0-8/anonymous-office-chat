FROM golang:alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build the Go application
RUN CGO_ENABLED=0 GOOS=linux go build -o backend main.go

# Start a new, completely empty image
FROM alpine:latest
WORKDIR /root/

# Copy the pre-built binary file from the previous stage
COPY --from=builder /app/backend .

# Make directories for the database and uploads
RUN mkdir -p /root/db /root/uploads

# Expose port
EXPOSE 8080

# Run executable
CMD ["./backend"]

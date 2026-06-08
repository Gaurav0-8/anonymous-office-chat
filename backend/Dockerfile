FROM alpine:latest
WORKDIR /root/

# Copy the pre-compiled Linux binary from the build context
COPY backend-linux ./backend

# Make it executable
RUN chmod +x ./backend

# Make directories for the database and uploads
RUN mkdir -p /root/db /root/uploads

# Expose port
EXPOSE 8080

# Run executable
CMD ["./backend"]

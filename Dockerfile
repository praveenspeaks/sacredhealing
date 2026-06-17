FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Persistent uploads directory — mount a named volume here in EasyPanel
# so admin-uploaded images survive redeployments.
# Set UPLOAD_DIR=/data/uploads in EasyPanel env vars to match this path.
RUN mkdir -p /data/uploads

EXPOSE 3000

# Declare the mount point so EasyPanel / Docker Compose can attach a volume
VOLUME ["/data/uploads"]

CMD ["node", "server.js"]

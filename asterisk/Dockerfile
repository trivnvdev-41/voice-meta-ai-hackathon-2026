FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    asterisk asterisk-core-sounds-en-wav openssl ffmpeg \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --break-system-packages "httpx>=0.27" "psycopg[binary]>=3.1"
WORKDIR /opt/copilot
COPY asterisk/pjsip.conf.template asterisk/extensions.conf asterisk/rtp.conf /etc/asterisk/
COPY asterisk/docker-entrypoint.sh /usr/local/bin/
COPY asterisk/ai_bridge.py /opt/copilot/
COPY worker/src /opt/copilot/worker/src
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /opt/copilot/ai_bridge.py
EXPOSE 5060/udp 5061/tcp 10000-10100/udp
ENTRYPOINT ["docker-entrypoint.sh"]

FROM typesense/typesense:27.1
RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*
COPY start.sh /start.sh
RUN chmod +x /start.sh
ENTRYPOINT ["/start.sh"]

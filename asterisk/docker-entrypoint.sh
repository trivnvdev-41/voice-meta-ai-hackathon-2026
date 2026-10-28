#!/bin/sh
# Render pjsip.conf from env, ensure TLS keys exist, run Asterisk foreground.
set -eu

: "${EXTERN_IP:?set EXTERN_IP to the server public IP or hostname}"
: "${META_SIP_USERNAME:?set META_SIP_USERNAME from Meta SIP settings}"
: "${META_SIP_PASSWORD:?set META_SIP_PASSWORD from Meta SIP settings}"
: "${META_SIP_ALLOW:=172.16.0.0/12}"

KEYDIR=/etc/asterisk/keys
mkdir -p "$KEYDIR"
if [ ! -f "$KEYDIR/asterisk.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEYDIR/asterisk.key" -out "$KEYDIR/asterisk.pem" \
    -days 825 -subj "/CN=$EXTERN_IP"
  chmod 600 "$KEYDIR/asterisk.key"
fi

sed -e "s|\${EXTERN_IP}|$EXTERN_IP|g" \
    -e "s|\${META_SIP_USERNAME}|$META_SIP_USERNAME|g" \
    -e "s|\${META_SIP_PASSWORD}|$META_SIP_PASSWORD|g" \
    -e "s|\${META_SIP_ALLOW}|$META_SIP_ALLOW|g" \
    /etc/asterisk/pjsip.conf.template > /etc/asterisk/pjsip.conf

exec asterisk -f -vvv

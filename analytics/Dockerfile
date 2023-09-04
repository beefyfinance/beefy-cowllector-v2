FROM grafana/grafana:10.1.1

# add custom configuration file
ADD ./custom.ini /etc/grafana/grafana.ini

# provision the instance
ADD ./provisioning/datasources/* /etc/grafana/provisioning/datasources/
ADD ./provisioning/alerting/* /etc/grafana/provisioning/alerting/

# replace env vars
RUN sed -i s/__DISCORD_PING_ROLE_ID_ON_ERROR__/$(echo $DISCORD_PING_ROLE_ID_ON_ERROR)/g /etc/grafana/provisioning/alerting/discord_templates.yml

ADD ./heroku-run.sh /heroku-run.sh

ENTRYPOINT [ "/heroku-run.sh" ]
FROM grafana/grafana:10.1.1

# add custom configuration file
COPY ./custom.ini /etc/grafana/grafana.ini

# provision the instance
COPY ./provisioning/dashboards /etc/grafana/provisioning/dashboards
COPY ./provisioning/datasources /etc/grafana/provisioning/datasources
COPY ./provisioning/alerting /etc/grafana/provisioning/alerting

COPY ./heroku-run.sh /heroku-run.sh

ENTRYPOINT [ "/heroku-run.sh" ]
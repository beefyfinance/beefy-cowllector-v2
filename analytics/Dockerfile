FROM grafana/grafana:10.1.1

# add custom configuration file
ADD ./custom.ini /etc/grafana/grafana.ini

# provision the instance
ADD ./provisioning/dashboards/* /etc/grafana/provisioning/dashboards/
ADD ./provisioning/datasources/* /etc/grafana/provisioning/datasources/
ADD ./provisioning/alerting/* /etc/grafana/provisioning/alerting/

ADD ./heroku-run.sh /heroku-run.sh

ENTRYPOINT [ "/heroku-run.sh" ]
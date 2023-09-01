FROM grafana/grafana:10.1.1

# add custom configuration file
ADD ./config/custom.ini /etc/grafana/grafana.ini

# add custom datasource file
ADD ./config/cowllector_db_datasource.yml /etc/grafana/provisioning/datasources/cowllector_db_datasource.yaml

ADD ./heroku-run.sh /heroku-run.sh

ENTRYPOINT [ "/heroku-run.sh" ]
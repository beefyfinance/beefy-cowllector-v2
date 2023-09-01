FROM grafana/grafana:10.1.1

# add custom configuration file
ADD ./config/custom.ini /etc/grafana/grafana.ini

# add custom datasource file
ADD ./config/reporting_datasource.yaml /etc/grafana/provisioning/datasources/datasource.yaml
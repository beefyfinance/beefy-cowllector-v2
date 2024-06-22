import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';
import { runMain } from '../../util/process';

async function main() {
    const ymlPath = path.join(__dirname, '../../../analytics/provisioning/alerting/discord_templates.yml');
    const ymlContent = fs.readFileSync(ymlPath, 'utf8');
    const parsedYml = parse(ymlContent);

    let templateStr = '';
    for (const template of parsedYml.templates) {
        const str = template.template
            .split('\n')
            .map((l: unknown) => ` ${l}`)
            .join('\n');
        templateStr += `{{- define "${template.name}" -}}\n`;
        templateStr += `${str}`;
        templateStr += '{{- end -}}\n';
    }
    templateStr += `{{ template "discord.message" . }}\n`;
    console.log(templateStr);
}

runMain(main);

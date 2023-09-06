import { runMain } from '../../util/process';
import { parse } from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const ymlPath = path.join(__dirname, '../../../analytics/provisioning/alerting/discord_templates.yml');
    const ymlContent = fs.readFileSync(ymlPath, 'utf8');
    const parsedYml = parse(ymlContent);

    let templateStr = '';
    for (const template of parsedYml.templates) {
        const str = template.template
            .split('\n')
            .map((l: any) => ` ${l}`)
            .join('\n');
        templateStr += `{{- define "${template.name}" -}}\n`;
        templateStr += `${str}`;
        templateStr += `{{- end -}}\n`;
    }
    templateStr += `{{ template "discord.message" . }}\n`;
    console.log(templateStr);
}

runMain(main);

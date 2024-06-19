import Fastify from 'fastify'
import cors from '@fastify/cors'
import { readFileSync, writeFileSync } from 'fs'
import axios from 'axios'
import { exec } from 'child_process'

// load config
let config = JSON.parse(readFileSync('config.json', 'utf8'))
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const fastify = Fastify({})
async function lookupScene (sceneid) {
    const query = "query ($id: ID!) { findScene(id: $id) { files { path }}}"
    return axios.post(config.stashurl, {
        query, variables: { id: sceneid }
    }, {
        headers: { "ApiKey": config.stashapikey }
    }).then(res => res.data.data.findScene.files[0]?.path
    ).catch (err => {
        if (err.response) console.log(err.response.data)
        else console.log(err)
    })
}

function updateConfig (newConfig) {
    let replacementConfig = {
        ...config,
        stashurl: newConfig.stashurl ?? config.stashurl,
        stashapikey: newConfig.stashapikey ?? config.stashapikey,
        paths: newConfig.paths ?? config.paths
    }
    writeFileSync('config.json', JSON.stringify(replacementConfig, null, 2))
    config = replacementConfig
}

async function openScene (sceneid, player) {
    let path = await lookupScene(sceneid)
    // path replacement
    for (const [key, value] of Object.entries(config.paths)) {
        path = path.replace(key, value)
    }
    // check if windows
    if (process.platform === 'win32') {
        // check if player is defined
        const program = player ? `"${config.players[player]}"` : `start ""`
        console.log(program, path)
        exec(`${program} "${path}"`)
    } else if (process.platform === 'linux') {
        const program = player ?? "xdg-open"
        exec(`${program} "${path}"`)
    } else if (process.platform === 'darwin') {
        console.error("macOS is not supported yet")
    }
}

// start
function startWebserver () {
  fastify.register(cors, {
    origin: "*",
    methods: ["GET"]
  });
  fastify.get("/health", async (req, reply) => {
    reply.code(200).send("ok");
  });
  fastify.post("/config", async (req, reply) => {
    const { stashurl, stashapikey, paths } = req.body;
    updateConfig({ stashurl, stashapikey, paths })
    reply.code(200).send("ok");
  })
  fastify.get("/open/:sceneid/:player?", async (request, reply) => {
    const { sceneid, player } = request.params;
    openScene(sceneid, player)
    reply.code(200).send(`opening scene ${sceneid} with ${player}`);
  });
  fastify.get("*", function (req, reply) {
    reply.code(404).send();
  });
  fastify.listen({ port: 19999 }, function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`server listening on ${address}`);
  });
}
startWebserver();

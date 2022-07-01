import cluster from "cluster";
import http from "http";
import process from "process";
import { setupPrimary } from "@socket.io/sticky";
import { start } from "./index.js";
const WORKERS_COUNT = 4;

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);

    for (let i = 0; i < WORKERS_COUNT; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died!`);
        cluster.fork();
    })

    const httpServer = http.createServer();
    setupPrimary(httpServer, {
        loadBalancingMethod: "least-connection",
    });

    const PORT = process.env.PORT || 4000;

    httpServer.listen(4000, () => {
        console.log(`server listtening at port${PORT}`);
    })
} else {
    console.log(`Worker ${process.pid} Started`);
    start()
}

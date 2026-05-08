"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import {
  getClientNetworkMetrics,
  resetClientNetworkMetrics,
  type ClientNetworkMetrics,
} from "@/lib/api/network-metrics";

export function NetworkMetricsPanel() {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<ClientNetworkMetrics>(getClientNetworkMetrics());

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics(getClientNetworkMetrics());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <Button
          size="sm"
          color="primary"
          variant="shadow"
          onPress={() => setOpen(true)}
          startContent={<Icon icon="solar:chart-linear" />}
          className="shadow-lg"
        >
          Network Metrics
        </Button>
      ) : (
        <Card className="w-[320px] border border-default-200 shadow-xl">
          <CardHeader className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="solar:chart-2-bold" className="text-primary" />
              <p className="font-semibold text-sm">Client Network Metrics</p>
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setOpen(false)}
            >
              <Icon icon="solar:close-circle-linear" />
            </Button>
          </CardHeader>
          <CardBody className="pt-0 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <Chip size="sm" variant="flat" color="primary">
                requests: {metrics.totalRequests}
              </Chip>
              <Chip size="sm" variant="flat" color="success">
                ok: {metrics.successfulRequests}
              </Chip>
              <Chip size="sm" variant="flat" color="danger">
                fail: {metrics.failedRequests}
              </Chip>
              <Chip size="sm" variant="flat" color="secondary">
                avg: {metrics.avgLatencyMs}ms
              </Chip>
              <Chip size="sm" variant="flat" color="warning">
                dedupe: {metrics.dedupeHits}
              </Chip>
              <Chip size="sm" variant="flat" color="warning">
                cooldown: {metrics.cooldownHits}
              </Chip>
            </div>

            <p className="text-default-500">
              updated: {metrics.lastUpdatedAt ? new Date(metrics.lastUpdatedAt).toLocaleTimeString("th-TH") : "-"}
            </p>

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={() => {
                  resetClientNetworkMetrics();
                  setMetrics(getClientNetworkMetrics());
                }}
              >
                Reset
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

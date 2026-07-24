from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

import yaml

MAX_ARCHITECTURE_BYTES = 2 * 1024 * 1024
DATABASE_MARKERS = ("cockroach", "dynamodb", "mariadb", "mongo", "mysql", "postgres", "redis")


class ArchitectureParseError(ValueError):
    """Raised when architecture input cannot be parsed safely."""


def _port_value(value: object) -> str | int | None:
    if isinstance(value, (str, int)):
        return value
    if isinstance(value, Mapping):
        target = value.get("target")
        published = value.get("published")
        if target is not None and published is not None:
            return f"{published}:{target}"
        return target if isinstance(target, (str, int)) else None
    return None


def _service_records(data: object) -> list[dict[str, object]]:
    if not isinstance(data, Mapping):
        return []
    services = data.get("services")
    if not isinstance(services, Mapping):
        return []

    records: list[dict[str, object]] = []
    for name, raw_config in services.items():
        config = raw_config if isinstance(raw_config, Mapping) else {}
        raw_ports = config.get("ports", [])
        if not isinstance(raw_ports, list):
            raw_ports = [raw_ports] if raw_ports else []
        ports = [
            port
            for port in (_port_value(item) for item in raw_ports)
            if port is not None
        ]
        dependencies = config.get("depends_on", [])
        if isinstance(dependencies, Mapping):
            dependencies = list(dependencies)
        if not isinstance(dependencies, list):
            dependencies = [dependencies] if dependencies else []
        records.append(
            {
                "name": str(name),
                "image": str(config.get("image", "")),
                "ports": ports,
                "depends_on": [str(item) for item in dependencies],
            }
        )
    return records


def _external_apis(value: object, output: set[str], *, depth: int = 0) -> None:
    if depth > 20 or len(output) >= 200:
        return
    if isinstance(value, Mapping):
        for key, item in value.items():
            normalized_key = str(key).lower()
            if normalized_key in {"endpoint", "external_api", "url", "base_url"} and isinstance(
                item, str
            ):
                if item.startswith(("https://", "http://")):
                    output.add(item)
            _external_apis(item, output, depth=depth + 1)
    elif isinstance(value, list):
        for item in value:
            _external_apis(item, output, depth=depth + 1)


def parse_architecture(file_content: str, file_type: str) -> dict[str, object]:
    if len(file_content.encode("utf-8")) > MAX_ARCHITECTURE_BYTES:
        raise ArchitectureParseError("Architecture document exceeds the size limit")

    normalized_type = file_type.lower().lstrip(".")
    try:
        if normalized_type in {"yaml", "yml"}:
            data: Any = yaml.safe_load(file_content)
        elif normalized_type == "json":
            data = json.loads(file_content)
        else:
            raise ArchitectureParseError("Architecture type must be YAML or JSON")
    except (json.JSONDecodeError, yaml.YAMLError) as exc:
        raise ArchitectureParseError("Architecture document is malformed") from exc

    if not isinstance(data, Mapping):
        raise ArchitectureParseError("Architecture document must contain an object")

    services = _service_records(data)
    exposed_ports: list[dict[str, object]] = []
    for service in services:
        service_ports = service.get("ports", [])
        if isinstance(service_ports, list):
            exposed_ports.extend(
                {"service": service["name"], "port": port} for port in service_ports
            )
    databases = [
        service
        for service in services
        if any(
            marker in f"{service['name']} {service['image']}".lower()
            for marker in DATABASE_MARKERS
        )
    ]
    network_config = data.get("networks", {})
    if not isinstance(network_config, (Mapping, list)):
        network_config = {}
    endpoints: set[str] = set()
    _external_apis(data, endpoints)

    return {
        "services": services,
        "exposed_ports": exposed_ports,
        "databases": databases,
        "network_config": network_config,
        "external_apis": sorted(endpoints),
    }

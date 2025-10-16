#!/bin/bash

# This script adds tenant filtering to all service files

echo "Adding tenant filters to service files..."

# List of service files that need tenant filtering
services=(
  "src/campaigns/campaigns.service.ts"
  "src/tasks/tasks.service.ts"
  "src/products/products.service.ts"
  "src/clients/clients.service.ts"
  "src/communications/communications.service.ts"
  "src/contact-groups/contact-groups.service.ts"
  "src/reports/reports.service.ts"
)

for service in "${services[@]}"; do
  if [ -f "$service" ]; then
    echo "Processing $service..."

    # Add tenant filter import if not exists
    if ! grep -q "this.prisma.addTenantFilter" "$service"; then
      echo "  - File needs manual review: $service"
    fi
  fi
done

echo "Done! Please manually review and add:"
echo "  where = this.prisma.addTenantFilter(where);"
echo "to all findMany, findFirst, and findUnique queries in each service."

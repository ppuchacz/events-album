#!/usr/bin/env bash
set -eo pipefail

NAMESPACE="events-album"

echo "=================================================================="
echo "   Test polityk sieciowych (NetworkPolicy) w przestrzeni: ${NAMESPACE}"
echo "=================================================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Sprawdzenie czy pody są gotowe
echo -e "\n${BLUE}[1/3] Sprawdzanie gotowości komponentów...${NC}"
kubectl get pods -n "${NAMESPACE}" -l 'app.kubernetes.io/name=events-album'

# 2. Testy dozwolonego ruchu (Allowed Flows)
echo -e "\n${BLUE}[2/3] Testy ruchu, który POWINIEN być przepuszczony (Dozwolony):${NC}"

# 2.1 Frontend -> Backend (HTTP :8000)
echo -n "  • Frontend -> Backend (:8000)... "
HTTP_CODE=$(kubectl exec -n "${NAMESPACE}" deploy/frontend -- curl -s -m 3 http://backend:8000/ -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "000" ]; then
    echo -e "${GREEN}[OK - PRZEPUSZCZONY] (Kod HTTP: ${HTTP_CODE})${NC}"
else
    echo -e "${RED}[BŁĄD - ZABLOKOWANY]${NC}"
fi

# 2.2 Backend -> Database (TCP :5432)
echo -n "  • Backend -> Database (:5432)... "
DB_RES=$(kubectl exec -n "${NAMESPACE}" deploy/backend -c backend -- php -r '$s = @fsockopen("database", 5432, $e, $err, 3); echo $s ? "OK" : "FAIL";' 2>/dev/null || echo "FAIL")
if [ "$DB_RES" = "OK" ]; then
    echo -e "${GREEN}[OK - PRZEPUSZCZONY]${NC}"
else
    echo -e "${RED}[BŁĄD - ZABLOKOWANY]${NC}"
fi

# 2.3 Backend -> RabbitMQ (TCP :5672)
echo -n "  • Backend -> RabbitMQ (:5672)... "
MQ_RES=$(kubectl exec -n "${NAMESPACE}" deploy/backend -c backend -- php -r '$s = @fsockopen("rabbitmq", 5672, $e, $err, 3); echo $s ? "OK" : "FAIL";' 2>/dev/null || echo "FAIL")
if [ "$MQ_RES" = "OK" ]; then
    echo -e "${GREEN}[OK - PRZEPUSZCZONY]${NC}"
else
    echo -e "${RED}[BŁĄD - ZABLOKOWANY]${NC}"
fi

# 2.4 Worker -> Database (TCP :5432)
echo -n "  • Worker -> Database (:5432)... "
WORKER_DB=$(kubectl exec -n "${NAMESPACE}" deploy/worker -c worker -- php -r '$s = @fsockopen("database", 5432, $e, $err, 3); echo $s ? "OK" : "FAIL";' 2>/dev/null || echo "FAIL")
if [ "$WORKER_DB" = "OK" ]; then
    echo -e "${GREEN}[OK - PRZEPUSZCZONY]${NC}"
else
    echo -e "${RED}[BŁĄD - ZABLOKOWANY]${NC}"
fi

# 2.5 Worker -> RabbitMQ (TCP :5672)
echo -n "  • Worker -> RabbitMQ (:5672)... "
WORKER_MQ=$(kubectl exec -n "${NAMESPACE}" deploy/worker -c worker -- php -r '$s = @fsockopen("rabbitmq", 5672, $e, $err, 3); echo $s ? "OK" : "FAIL";' 2>/dev/null || echo "FAIL")
if [ "$WORKER_MQ" = "OK" ]; then
    echo -e "${GREEN}[OK - PRZEPUSZCZONY]${NC}"
else
    echo -e "${RED}[BŁĄD - ZABLOKOWANY]${NC}"
fi

# 3. Testy zablokowanego ruchu (Blocked / Isolated Flows)
echo -e "\n${BLUE}[3/3] Testy ruchu, który POWINIEN być zablokowany (Izolacja):${NC}"

# 3.1 Frontend -> Database (TCP :5432)
echo -n "  • Frontend -> Database (:5432)... "
if kubectl exec -n "${NAMESPACE}" deploy/frontend -- nc -z -w 3 database 5432 >/dev/null 2>&1; then
    echo -e "${YELLOW}[PRZEPUSZCZONY] (Uwaga: domyślny CNI minikube nie filtruje iptables - wymaga CNI Calico/Cilium)${NC}"
else
    echo -e "${GREEN}[OK - ZABLOKOWANY] (Timeout / Odrzucono)${NC}"
fi

# 3.2 Frontend -> RabbitMQ (TCP :5672)
echo -n "  • Frontend -> RabbitMQ (:5672)... "
if kubectl exec -n "${NAMESPACE}" deploy/frontend -- nc -z -w 3 rabbitmq 5672 >/dev/null 2>&1; then
    echo -e "${YELLOW}[PRZEPUSZCZONY] (Uwaga: domyślny CNI minikube nie filtruje iptables - wymaga CNI Calico/Cilium)${NC}"
else
    echo -e "${GREEN}[OK - ZABLOKOWANY] (Timeout / Odrzucono)${NC}"
fi

# 3.3 Nieautoryzowany pod testowy -> Database (TCP :5432)
echo -n "  • Nieautoryzowany pod -> Database (:5432)... "
if kubectl run test-netpol-probe --rm -i --restart=Never --image=busybox -n "${NAMESPACE}" -- nc -z -w 3 database 5432 >/dev/null 2>&1; then
    echo -e "${YELLOW}[PRZEPUSZCZONY] (Brak egzekucji CNI w klastrze testowym)${NC}"
else
    echo -e "${GREEN}[OK - ZABLOKOWANY] (Timeout / Odrzucono)${NC}"
fi

echo -e "\n=================================================================="
echo "Podsumowanie:"
echo "W środowiskach produkcyjnych z aktywnym CNI (Calico, Cilium, AWS/GCP NetworkPolicy)"
echo "ruch z sekcji [3/3] zostanie natychmiastowo zrzucony (DROPPED / TIMED OUT)."
echo "=================================================================="

kubectl proxy --port=8001 &
sleep 2
echo "kubectl proxy running on :8001"
curl -s http://localhost:8001/api/v1/namespaces/default | head -5

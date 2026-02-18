"""
Tests for /api/connectors endpoints.
"""
from unittest.mock import patch


class TestConnectorTestEndpoint:
    """POST /api/connectors/{id}/test"""

    def test_returns_404_when_connector_missing(self, test_app, mock_supabase):
        mock_supabase.query_builder.set_response(data=None)

        response = test_app.post("/api/connectors/missing-id/test")
        assert response.status_code == 404

    def test_returns_success_when_connectivity_check_passes(self, test_app, mock_supabase):
        mock_supabase.query_builder.set_response(
            data={
                "id": "connector-1",
                "name": "sam",
                "encrypted_credentials": "encrypted",
            }
        )

        with patch("backend.routers.connectors.decrypt_credentials", return_value={"api_key": "abc"}), \
             patch("backend.routers.connectors._run_connector_test", return_value=(True, 200, "ok")):
            response = test_app.post("/api/connectors/connector-1/test")

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["message"] == "ok"

    def test_returns_connector_error_when_connectivity_check_fails(self, test_app, mock_supabase):
        mock_supabase.query_builder.set_response(
            data={
                "id": "connector-2",
                "name": "govcon",
                "encrypted_credentials": "encrypted",
            }
        )

        with patch("backend.routers.connectors.decrypt_credentials", return_value={"api_key": "bad"}), \
             patch("backend.routers.connectors._run_connector_test", return_value=(False, 502, "failed")):
            response = test_app.post("/api/connectors/connector-2/test")

        assert response.status_code == 502
        assert response.json()["detail"] == "failed"

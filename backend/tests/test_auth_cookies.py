import unittest
from unittest.mock import patch
from starlette.requests import Request
from starlette.responses import Response
from fastapi import HTTPException

from app.api.auth import auth_logout, get_current_user


class LogoutCookieTests(unittest.TestCase):
    def test_production_logout_deletes_session_with_issued_attributes(self):
        with patch("app.api.auth._secure_cookie", return_value=True):
            response = auth_logout()
        cookies = response.headers.getlist("set-cookie")
        session_cookie = next(header for header in cookies if header.startswith("captionkit_session="))
        self.assertIn("Max-Age=0", session_cookie)
        self.assertIn("Path=/", session_cookie)
        self.assertIn("HttpOnly", session_cookie)
        self.assertIn("Secure", session_cookie)
        self.assertIn("SameSite=None", session_cookie)

    def test_missing_session_cookie_is_rejected_after_logout(self):
        request = Request({"type": "http", "headers": [], "method": "GET", "path": "/auth/me", "query_string": b"", "server": ("test", 80), "client": ("test", 1), "scheme": "https"})
        with self.assertRaises(HTTPException) as raised:
            get_current_user(request, Response())
        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()

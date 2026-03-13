import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gweye_backend.settings')

from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
import chat.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": URLRouter(chat.routing.websocket_urlpatterns),
})
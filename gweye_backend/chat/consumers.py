import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken
from .models import ChatRoom, Message


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        # Récupérer le token depuis l'URL (?token=xxx)
        token = self.scope['query_string'].decode().split('token=')[-1]
        
        self.user = await self.get_user_from_token(token)
        
        if not self.user:
            await self.close()
            return

        user_id = self.scope['url_route']['kwargs'].get('user_id') if self.user.is_staff else str(self.user.id)
        self.room_group_name = f'chat_{user_id}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get('type') == 'message' and data.get('content'):
            msg = await self.save_message(data['content'])
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': msg.id,
                        'content': msg.content,
                        'sender': msg.sender.username,
                        'sender_id': msg.sender.id,
                        'is_staff': msg.sender.is_staff,
                        'created_at': str(msg.created_at),
                    }
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            validated = AccessToken(token)
            user_id = validated['user_id']
            return User.objects.get(id=user_id)
        except Exception:
            return None

    @database_sync_to_async
    def save_message(self, content):
        uid = self.scope['url_route']['kwargs'].get('user_id')
        room_user = User.objects.get(id=uid) if (self.user.is_staff and uid) else self.user
        room, _ = ChatRoom.objects.get_or_create(user=room_user)
        return Message.objects.create(room=room, sender=self.user, content=content)
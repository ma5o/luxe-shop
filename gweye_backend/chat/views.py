from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ChatRoom, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    is_staff = serializers.BooleanField(source='sender.is_staff', read_only=True)

    class Meta:
        model = Message
        fields = '__all__'


class ChatRoomSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = '__all__'

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {'content': msg.content, 'created_at': str(msg.created_at)}
        return None

    def get_unread_count(self, obj):
        return obj.messages.filter(is_read=False, sender__is_staff=False).count()


@api_view(['GET'])
def get_my_messages(request):
    room, _ = ChatRoom.objects.get_or_create(user=request.user)
    messages = room.messages.all()
    return Response(MessageSerializer(messages, many=True).data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_rooms(request):
    rooms = ChatRoom.objects.all().order_by('-created_at')
    return Response(ChatRoomSerializer(rooms, many=True).data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_room_messages(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        room, _ = ChatRoom.objects.get_or_create(user=user)
        messages = room.messages.all()
        # Mark as read
        messages.filter(sender__is_staff=False).update(is_read=True)
        return Response(MessageSerializer(messages, many=True).data)
    except User.DoesNotExist:
        return Response({'error': 'Utilisateur non trouvé.'}, status=404)
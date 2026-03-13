from django.urls import path
from . import views

urlpatterns = [
    path('messages/', views.get_my_messages, name='my-messages'),
    path('admin/rooms/', views.admin_get_rooms, name='admin-rooms'),
    path('admin/rooms/<int:user_id>/', views.admin_get_room_messages, name='admin-room-messages'),
]
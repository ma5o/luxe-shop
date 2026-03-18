from rest_framework import serializers
from .models import Product, ProductImage, Category, Order, OrderItem


class ProductImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'image_url', 'order']

    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField()
    image_url     = serializers.SerializerMethodField()
    images        = ProductImageSerializer(many=True, read_only=True)
    all_images    = serializers.ReadOnlyField()

    class Meta:
        model  = Product
        fields = ['id', 'name', 'description', 'price', 'stock', 'category',
                  'category_name', 'image', 'image_url', 'images', 'all_images', 'is_active', 'created_at']

    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ['id', 'name', 'slug']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField()
    total        = serializers.ReadOnlyField()

    class Meta:
        model  = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price', 'total']


class OrderSerializer(serializers.ModelSerializer):
    items        = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.ReadOnlyField()
    username     = serializers.SerializerMethodField()
    user_email   = serializers.SerializerMethodField()

    class Meta:
        model  = Order
        fields = ['id', 'user', 'username', 'user_email', 'status', 'status_display',
                  'shipping_address', 'notes', 'total_price', 'payment_screenshot',
                  'items', 'created_at']

    def get_username(self, obj):
        return obj.user.username

    def get_user_email(self, obj):
        return obj.user.email
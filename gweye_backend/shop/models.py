from django.db import models
import uuid

def product_image_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    return f'products/{filename}'

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class Product(models.Model):
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price       = models.DecimalField(max_digits=10, decimal_places=2)
    stock       = models.IntegerField(default=0)
    category    = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    # Image principale (gardée pour compatibilité)
    image = models.ImageField(upload_to=product_image_path, blank=True, null=True)

    def __str__(self):
        return self.name

    @property
    def category_name(self):
        return self.category.name if self.category else None

    @property
    def all_images(self):
        images = list(self.images.values_list('image', flat=True))
        if self.image and str(self.image) not in images:
            images.insert(0, str(self.image))
        return images


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image   = models.ImageField(upload_to=product_image_path)
    order   = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image {self.id} de {self.product.name}"


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('payment_uploaded', 'Paiement reçu'),
        ('validated', 'Validée'),
        ('shipped', 'Expédiée'),
        ('delivered', 'Livrée'),
        ('cancelled', 'Annulée'),
    ]
    user             = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    shipping_address = models.TextField(blank=True)
    notes            = models.TextField(blank=True)
    total_price      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_screenshot = models.ImageField(upload_to='payments/', blank=True, null=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    @property
    def status_display(self):
        return dict(self.STATUS_CHOICES).get(self.status, self.status)

    def __str__(self):
        return f"Commande #{self.id} - {self.user.username}"


class OrderItem(models.Model):
    order    = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product  = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    price    = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def product_name(self):
        return self.product.name

    @property
    def total(self):
        return self.price * self.quantity